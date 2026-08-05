module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API Key missing' });

  try {
    const { grade, artType, topic } = req.body;
    
    // 문법 오류(Syntax Error)가 절대 발생할 수 없는 일반 문자열 결합 방식 사용
    const promptText = "미술관 도슨트로서 학생들을 위한 미술 감상 카드 3개를 만들어주세요.\n대상: " + grade + "\n미술 종류: " + artType + "\n주제: " + topic + "\n반드시 아래 JSON 배열 형식으로만 응답해야 하며, 마크다운 기호나 추가 설명 등 다른 텍스트는 절대 포함하지 마세요.\n[\n  {\n    \"title\": \"작품명\",\n    \"artist\": \"작가명\",\n    \"location\": \"소장처\",\n    \"year\": \"제작연도\",\n    \"commentary\": \"학생 수준에 맞는 작품 설명\",\n    \"objective\": \"그림에서 보이는 사실 찾기 질문\",\n    \"subjective\": \"느낌이나 상상을 묻는 질문\",\n    \"evaluative\": \"작가의 의도나 판단을 묻는 질문\"\n  }\n]";

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error("API Error: " + response.status);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(responseText);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
