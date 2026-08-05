module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { grade, artType, topic } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  const prompt = `초등학교 교사를 돕는 미술 교육 전문 큐레이터로서 답변해.
대상학년: ${grade}, 작품종류: ${artType}, 수업주제: ${topic}
요구사항: 위 조건에 맞는 미술 작품 3개를 추천해.
규칙: 
1. 인물이 등장하지 않는 풍경화나 정물화일 경우, '주인공의 심정' 등 연관 없는 질문 절대 금지. 구도, 색채, 빛, 분위기 중심.
2. 반드시 아래 JSON 배열 형식으로만 응답해. 백틱이나 텍스트 포함 금지.

[
  {
    "title": "작품명",
    "artist": "작가명",
    "year": "제작연도",
    "location": "소장처",
    "commentary": "교사용 해설 (3~4문장)",
    "objective": "객관적 질문 1개",
    "subjective": "주관적 질문 1개",
    "evaluative": "평가적 질문 1개"
  }
]`;

  try {
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await apiResponse.json();
    
    if (!data.candidates || !data.candidates[0].content) {
      return res.status(500).json({ error: '구글 API 오류: ' + JSON.stringify(data) });
    }

    let textResponse = data.candidates[0].content.parts[0].text;
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const jsonStart = textResponse.indexOf('[');
    const jsonEnd = textResponse.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      textResponse = textResponse.substring(jsonStart, jsonEnd + 1);
    }

    const parsedData = JSON.parse(textResponse);
    return res.status(200).json(parsedData);
  } catch (error) {
    return res.status(500).json({ error: '서버 파싱 오류: ' + error.message });
  }
};
