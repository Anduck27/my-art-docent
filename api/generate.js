module.exports = async (req, res) => {
  const origin = req.headers.origin;

  if (origin && origin.includes('my-art-docent')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    if (!origin || !origin.includes('my-art-docent')) {
      return res.status(403).end(); 
    }
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const rawApiKey = process.env.GEMINI_API_KEY;
  if (!rawApiKey) return res.status(500).json({ error: 'API Key missing' });
  const apiKey = rawApiKey.trim();

  try {
    const { grade, artType, topic } = req.body;

    // 1. 강제 금칙어 1차 방어선 (날짜 등 정상 단어가 오탐되지 않도록 패턴 정밀화)
    const blockPatterns = [
      /시\s*[0-9\W]*발/, /씨\s*[0-9\W]*발/, /\bㅅ\s*[0-9\W]*ㅂ\b/, 
      /병\s*[0-9\W]*신/, /\bㅂ\s*[0-9\W]*ㅅ\b/, /등\s*[0-9\W]*신/, 
      /새\s*[0-9\W]*끼/, /개\s*새\s*[0-9\W]*끼/,      
      /\b좆\b/, /존\s*[0-9\W]*나/, /졸\s*[0-9\W]*라/,           
      /지\s*[0-9\W]*랄/, /\bㅈ\s*[0-9\W]*ㄹ\b/,               
      /미\s*[0-9\W]*친/, /\bㅁ\s*[0-9\W]*ㅊ\b/,               
      /tlqkf/, /rotoRL/, /qudtls/, /wht/, /wlfkf/,    
      /섹스/, /성관계/, /성기/, /야동/, /자위/, /딸딸이/, 
      /\b살인\b/, /\b자살\b/, /\b강간\b/, /폭력적인/, /목이\s*잘린/     
    ];

    const hasBadWord = blockPatterns.some(pattern => pattern.test(topic));
    if (hasBadWord) {
      throw new Error("부적절한 단어가 포함되어 있습니다.");
    }
    
    // 2. 프롬프트 개선: 학년 반영 및 작가 의도 배제 통제
    const promptText = `미술관 도슨트로서 초등학교 ${grade} 학생들을 위한 미술 감상 카드 3개를 만들어주세요.
미술 종류: ${artType}
주제: ${topic}
각 카드에는 작품명(title), 작가명(artist), 소장처(location), 제작연도(year), ${grade} 수준에 맞는 친절한 설명(commentary), 객관적 질문(objective), 주관적 질문(subjective), 평가적 질문(evaluative)이 포함되어야 합니다. 평가적 질문에는 절대 작가의 의도나 미술사적 지식을 묻지 말고, ${grade} 학생이 마음에 드는지 주관적 판단을 내리게 하세요.`;

    const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=";
    const url = baseUrl + apiKey;

    // 3. 구조화된 출력 스키마 정의 (JSON 파싱 에러 원천 차단)
    const responseSchema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          artist: { type: "STRING" },
          location: { type: "STRING" },
          year: { type: "STRING" },
          commentary: { type: "STRING" },
          objective: { type: "STRING" },
          subjective: { type: "STRING" },
          evaluative: { type: "STRING" }
        },
        required: ["title", "artist", "location", "year", "commentary", "objective", "subjective", "evaluative"]
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { 
          responseMimeType: "application/json",
          responseSchema: responseSchema 
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error("API Error: " + response.status + " - " + errorData);
    }

    const data = await response.json();

    if (data.promptFeedback && data.promptFeedback.blockReason) {
      throw new Error("부적절한 단어가 포함되어 있습니다.");
    }

    if (!data.candidates || data.candidates.length === 0 || data.candidates[0].finishReason === 'SAFETY') {
      throw new Error("부적절한 단어가 포함되어 있습니다.");
    }

    const responseText = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(responseText);
    
    return res.status(200).json(result);
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
