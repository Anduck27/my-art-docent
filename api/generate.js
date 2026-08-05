module.exports = async (req, res) => {
  // CORS 설정 (프론트엔드와의 통신 허용)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 사전 요청(Preflight) 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 메서드 이외의 접근 차단
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel 환경 변수에 API 키가 설정되지 않았습니다.' });
  }

  try {
    // 프론트엔드에서 전달받은 사용자 입력 데이터
    const { grade, artType, topic } = req.body;

    // AI에게 지시할 프롬프트 구성
    const promptText = `
      미술관 도슨트로서 학생들을 위한 미술 감상 카드 3개를 만들어주세요.
      대상: ${grade}학년
      미술 종류: ${artType}
      주제: ${topic}
      
      반드시 아래 JSON 배열 형식으로만 응답해야 하며, 백틱(```)이나 추가 설명 등 다른 텍스트는 절대 포함하지 마세요.
      [
        {
          "title": "작품명",
          "artist": "작가명",
          "description": "학생 수준에 맞는 작품 설명",
          "question": "학생의 깊이 있는 생각을 묻는 감상 질문"
        }
      ]
    `;

    // 최신 규격 모델인 gemini-1.5-flash 적용
    const url = `[https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$){apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        // 모델이 JSON 형식으로만 응답하도록 강제
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
    
    // API 응답에서 실제 텍스트 데이터 추출
    const responseText = data.candidates[0].content.parts[0].text;
    
    // 문자열을 JSON 객체로 안전하게 변환
    const cleanJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJsonText);

    // 프론트엔드로 완성된 3개의 배열 데이터 전송
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('API 호출 중 오류 발생:', error);
    return res.status(500).json({ error: error.message });
  }
};
