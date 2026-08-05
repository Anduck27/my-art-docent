module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel 환경 변수에 API 키가 설정되지 않았습니다.' });
  }

  try {
    const { grade, artType, topic } = req.body;

    // 오류 원인이었던 프롬프트 텍스트 내 백틱 기호(```) 제거 및 수정
    const promptText = `
      미술관 도슨트로서 학생들을 위한 미술 감상 카드 3개를 만들어주세요.
      대상: ${grade}학년
      미술 종류: ${artType}
      주제: ${topic}
      
      반드시 아래 JSON 배열 형식으로만 응답해야 하며, 마크다운 기호나 추가 설명 등 다른 텍스트는 절대 포함하지 마세요.
      [
        {
          "title": "작품명",
          "artist": "작가명",
          "description": "학생 수준에 맞는 작품 설명",
          "question": "학생의 깊이 있는 생각을 묻는 감상 질문"
        }
      ]
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google API 통신 에러: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    // 혹시 모를 잔여 마크다운 기호 제거 후 JSON 파싱
    const cleanJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJsonText);

    return res.status(200).json(result);
    
  } catch (error) {
    console.error('API 호출 중 오류 발생:', error);
    return res.status(500).json({ error: error.message });
  }
};
