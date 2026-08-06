module.exports = async (req, res) => {
  // CORS 설정: 외부에서도 접근 가능하도록 허용
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. API 키 불러오기 및 불필요한 공백/줄바꿈 완벽 제거
  const rawApiKey = process.env.GEMINI_API_KEY;
  if (!rawApiKey) return res.status(500).json({ error: 'API Key missing' });
  const apiKey = rawApiKey.trim();

  try {
    const { grade, artType, topic } = req.body;
    
    // 프롬프트 작성 (백틱 ` 을 사용하여 깔끔하게 문자열 유지)
    const promptText = `미술관 도슨트로서 학생들을 위한 미술 감상 카드 3개를 만들어주세요.
대상: ${grade}
미술 종류: ${artType}
주제: ${topic}
반드시 아래 JSON 배열 형식으로만 응답해야 하며, 마크다운 기호(\`\`\`json 등)나 추가 설명 등 다른 텍스트는 절대 포함하지 마세요.
[
  {
    "title": "작품명",
    "artist": "작가명",
    "location": "소장처",
    "year": "제작연도",
    "commentary": "학생 수준에 맞는 작품 설명",
    "objective": "그림에서 보이는 사실 찾기 질문",
    "subjective": "느낌이나 상상을 묻는 질문",
    "evaluative": "작가의 의도나 판단을 묻는 질문"
  }
]`;

    // 2. URL 문자열 템플릿으로 깔끔하게 결합
    const url = `[https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$){apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    let responseText = data.candidates[0].content.parts[0].text;

    // 3. AI가 응답에 마크다운을 포함했을 경우를 대비한 예외 처리
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    const result = JSON.parse(responseText);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
};
