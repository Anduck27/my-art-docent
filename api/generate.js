module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const rawApiKey = process.env.GEMINI_API_KEY;
  if (!rawApiKey) return res.status(500).json({ error: 'Vercel 서버에 API 키가 설정되지 않았습니다. 환경 변수를 확인하세요.' });
  const apiKey = rawApiKey.trim();

  try {
    const { grade, artType, topic } = req.body;
    
    const promptText = "미술관 도슨트로서 학생들을 위한 미술 감상 카드 3개를 만들어주세요.\n대상: " + grade + "\n미술 종류: " + artType + "\n주제: " + topic + "\n반드시 아래 JSON 배열 형식으로만 응답해야 하며, 마크다운 기호나 추가 설명 등 다른 텍스트는 절대 포함하지 마세요.\n[\n  {\n    \"title\": \"작품명\",\n    \"artist\": \"작가명\",\n    \"location\": \"소장처\",\n    \"year\": \"제작연도\",\n    \"commentary\": \"학생 수준에 맞는 작품 설명\",\n    \"objective\": \"그림에서 보이는 사실 찾기 질문\",\n    \"subjective\": \"느낌이나 상상을 묻는 질문\",\n    \"evaluative\": \"작가의 의도나 판단을 묻는 질문\"\n  }\n]";

    const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=";
    const url = baseUrl + apiKey;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    // 구글 API가 반환하는 원본 에러 데이터를 강제로 프론트에 던집니다.
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API 세부 오류 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    let responseText = data.candidates[0].content.parts[0].text;

    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(responseText);

    return res.status(200).json(result);
  } catch (error) {
    // 프론트엔드의 alert 창에 구체적인 오류가 뜨도록 설정
    return res.status(500).json({ error: error.message });
  }
};
