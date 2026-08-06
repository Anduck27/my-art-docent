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

    // 1. 강제 금칙어 1차 방어선 (정규표현식 적용)
    // [0-9\W]* 는 글자 사이에 숫자나 특수기호, 공백이 들어가는 것을 모두 잡아냅니다.
    const blockPatterns = [
      /시[0-9\W]*발/, /씨[0-9\W]*발/, /ㅅ[0-9\W]*ㅂ/, // 시발, 씨발, ㅅㅂ 변형
      /병[0-9\W]*신/, /ㅂ[0-9\W]*ㅅ/, /등[0-9\W]*신/, // 병신, ㅂㅅ 변형
      /새[0-9\W]*끼/, /개[0-9\W]*새[0-9\W]*끼/,      // 새끼, 개새끼 변형
      /좆/, /존[0-9\W]*나/, /졸[0-9\W]*라/,           // 좆, 존나 변형
      /지[0-9\W]*랄/, /ㅈ[0-9\W]*ㄹ/,               // 지랄 변형
      /미[0-9\W]*친/, /ㅁ[0-9\W]*ㅊ/,               // 미친 변형
      /tlqkf/, /rotoRL/, /qudtls/, /wht/, /wlfkf/,    // 영타(QWERTY) 입력 계열
      /섹스/, /성관계/, /성기/, /야동/, /자위/, /딸딸이/, // 선정성
      /살인/, /자살/, /강간/, /폭력/, /목이\s*잘린/     // 폭력성 및 특정 잔혹 묘사
    ];

    // topic 문자열이 위 패턴 중 하나라도 일치하면 true 반환
    const hasBadWord = blockPatterns.some(pattern => pattern.test(topic));

    if (hasBadWord) {
      // AI에 요청을 보내기도 전에 즉시 차단
      throw new Error("부적절한 단어가 포함되어 있습니다.");
    }
    
    // 2. 프롬프트 개선: 학년(grade) 반영 및 평가 질문의 명확한 통제
    const promptText = `미술관 도슨트로서 초등학교 ${grade} 학생들을 위한 미술 감상 카드 3개를 만들어주세요.
미술 종류: ${artType}
주제: ${topic}
반드시 아래 JSON 배열 형식으로만 응답해야 하며, 마크다운 기호나 추가 설명 등 다른 텍스트는 절대 포함하지 마세요.
[
  {
    "title": "작품명",
    "artist": "작가명",
    "location": "소장처",
    "year": "제작연도",
    "commentary": "${grade} 학생 수준에 맞는 친절하고 이해하기 쉬운 작품 설명",
    "objective": "그림에서 눈으로 직접 관찰하고 찾을 수 있는 사실에 대한 질문",
    "subjective": "그림을 보고 느껴지는 감정이나 재미있는 상상을 묻는 질문",
    "evaluative": "절대 작가의 의도나 미술사적 지식을 묻지 마세요. ${grade} 학생 스스로 이 작품이 마음에 드는지 주관적 판단을 내릴 수 있는 매우 쉬운 질문만 하세요. (예: 이 그림에 별점 5점 만점 중 몇 점을 주고 싶나요?, 이 그림을 내 방에 걸어둔다면 어디가 좋을까요?, 이 그림을 친구에게 추천한다면 어떤 점을 말해주고 싶나요?)"
  }
]`;

    const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=";
    const url = baseUrl + apiKey;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" },
        // 2차 방어선: AI 자체 안전 설정
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

    let responseText = data.candidates[0].content.parts[0].text;
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const result = JSON.parse(responseText);
    return res.status(200).json(result);
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
