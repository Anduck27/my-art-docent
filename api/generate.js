export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { grade, artType, topic } = req.body;
  const apiKey = process.env.GEMINI_API_KEY; // Vercel 환경 변수에 숨겨둔 마스터 키

  if (!apiKey) {
    return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.' });
  }

  const prompt = `초등학교 교사를 돕는 미술 교육 전문 큐레이터로서 답변해줘.
대상학년: ${grade}, 작품종류: ${artType}, 수업주제: ${topic}
규칙: 
1. 인물이 등장하지 않는 풍경화나 정물화일 경우, '주인공의 심정' 등 연관 없는 질문을 절대 만들지 말고 구도, 색채, 빛, 분위기 중심의 질문을 만들어줘.
2. 반드시 아래 JSON 형식으로만 응답해줘. (마크다운 백틱 \`\`\`json 등 절대 포함 금지, 오직 순수 JSON 문자열만 출력)

{
  "title": "작품명",
  "artist": "작가명",
  "year": "제작연도",
  "location": "소장처",
  "commentary": "교사용 해설 (3~4문장)",
  "objective": "객관적 질문 1개",
  "subjective": "주관적 질문 1개 (인물 심정 금지, 풍경/정물이면 감각이나 상상 위주)",
  "evaluative": "평가적 질문 1개"
}`;

  try {
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await apiResponse.json();
    const textResponse = data.candidates[0].content.parts[0].text;
    
    // 혹시 모를 마크다운 백틱 제거
    const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    return res.status(200).json(parsedData);
  } catch (error) {
    return res.status(500).json({ error: 'AI 응답 생성 중 오류가 발생했습니다.' });
  }
}