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
    
    // 수정됨: evaluative(평가 질문) 내용을 학생의 주관적 평가와 판단을 유도하도록 변경
    const promptText = "미술관 도슨트로서 학생들을 위한 미술 감상 카드 3개를 만들어주세요.\n대상: " + grade + "\n미술 종류: " + artType + "\n주제: " + topic + "\n반드시 아래 JSON 배열 형식으로만 응답해야 하며, 마크다운 기호나 추가 설명 등 다른 텍스트는 절대 포함하지 마세요.\n[\n  {\n    \"title\": \"작품명\",\n    \"artist\": \"작가명\",\n    \"location\": \"소장처\",\n    \"year\": \"제작연도\",\n    \"commentary\": \"학생 수준에 맞는 작품 설명\",\n    \"objective\": \"그림에서 보이는 사실 찾기 질문\",\n    \"subjective\": \"느낌이나 상상을 묻는 질문\",\n    \"evaluative\": \"작품의 가치나 표현 방식에 대해 학생이 직접 평가하고 판단을 내리도록 유도하는 질문\"\n  }\n]";

    const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=";
    const url = baseUrl + apiKey;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" },
        // 추가됨: 초등학교 환경에 맞춘 최고 수준의 유해성 차단 필터
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

    // 추가됨: 사용자의 입력이 유해하여 프롬프트 단계에서 즉각 차단된 경우
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      throw new Error("부적절한 단어가 포함되어 있습니다.");
    }

    // 추가됨: 결과물 생성 중 유해성이 감지되어 답변 생성이 중단(SAFETY)된 경우
    if (!data.candidates || data.candidates.length === 0 || data.candidates[0].finishReason === 'SAFETY') {
      throw new Error("부적절한 단어가 포함되어 있습니다.");
    }

    let responseText = data.candidates[0].content.parts[0].text;
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const result = JSON.parse(responseText);
    return res.status(200).json(result);
    
  } catch (error) {
    // 프론트엔드의 catch 블록으로 에러 메시지(error.message)를 고스란히 전달
    return res.status(500).json({ error: error.message });
  }
};
