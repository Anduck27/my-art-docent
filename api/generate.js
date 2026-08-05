module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { grade, artType, topic } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  // API 키가 없으면 비상 샘플 데이터 반환 (서버 뻗음 방지)
  if (!apiKey || apiKey.length < 10) {
    return res.status(200).json(getFallbackData(grade, topic));
  }

  const prompt = `초등학교 교사를 돕는 미술 교육 전문 큐레이터로서 답변해줘.
대상학년: ${grade}, 작품종류: ${artType}, 수업주제: ${topic}
규칙: 
1. 인물이 등장하지 않는 풍경화나 정물화일 경우, '주인공의 심정' 등 연관 없는 질문을 절대 만들지 말고 구도, 색채, 빛, 분위기 중심의 질문을 만들어줘.
2. 반드시 오직 순수 JSON 형식으로만 응답해줘. 백틱(\`\`\`)이나 다른 텍스트는 절대 포함하지 마.

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

    if (!apiResponse.ok) {
      return res.status(200).json(getFallbackData(grade, topic));
    }

    const data = await apiResponse.json();
    
    if (!data.candidates || !data.candidates[0].content) {
      return res.status(200).json(getFallbackData(grade, topic));
    }

    let textResponse = data.candidates[0].content.parts[0].text;
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const jsonStart = textResponse.indexOf('{');
    const jsonEnd = textResponse.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      textResponse = textResponse.substring(jsonStart, jsonEnd + 1);
    }

    const parsedData = JSON.parse(textResponse);
    return res.status(200).json(parsedData);
  } catch (error) {
    return res.status(200).json(getFallbackData(grade, topic));
  }
};

function getFallbackData(grade, topic) {
  return {
    title: "아몬드 나무 (비상 연결 모드)",
    artist: "빈센트 반 고흐",
    year: "1890년",
    location: "반 고흐 미술관",
    commentary: `${grade} 학생들과 함께 '${topic}'을 다루기 좋은 명화입니다. 파란 하늘을 배경으로 피어난 하얀 아몬드 꽃 가지를 통해 생명의 환희와 새로운 시작을 느낄 수 있습니다. 화면을 채운 선의 리듬감과 차분한 청색 톤의 조화에 주목해 보세요.`,
    objective: "그림 전체를 지배하고 있는 가장 두드러진 두 가지 색상은 무엇인가요?",
    subjective: "봄의 찬란한 햇살 아래 아몬드 나뭇가지가 바람에 흔들릴 때 어떤 소리가 들릴 것 같나요?",
    evaluative: "고흐가 푸른 하늘 아래 피어난 아몬드 꽃을 통해 우리에게 전달하고자 했던 감정은 무엇일까요?"
  };
}
