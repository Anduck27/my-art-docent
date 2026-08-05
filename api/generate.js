module.exports = async function handler(req, res) {
    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
    }

    const { grade, artType, topic } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // 환경 변수 확인
    if (!apiKey) {
        return res.status(500).json({ error: 'API 키가 설정되지 않았습니다. Vercel 환경 변수를 확인하세요.' });
    }

    // 인공지능에게 전달할 프롬프트 (3개의 결과를 배열로 요구)
    const promptText = `
당신은 초등학교 교사를 위한 미술 교육 큐레이터입니다.
다음 조건에 맞춰 초등학생 눈높이에 맞는 명화 3점을 추천하고, 각각에 대한 해설과 탐구 질문을 작성해 주세요.
결과는 반드시 아래의 JSON 배열(Array) 형식으로만 반환해야 하며, 마크다운 기호(\`\`\`json 등)나 다른 설명 텍스트는 일절 포함하지 마세요.

조건:
- 대상 학년: ${grade}
- 작품 종류: ${artType}
- 수업 주제: ${topic}

반환 형식 (JSON Array):
[
  {
    "title": "작품명",
    "artist": "작가명",
    "year": "제작연도",
    "location": "소장처",
    "commentary": "교사를 위한 작품 해설 (초등학생 눈높이에 맞춘 감상 포인트 포함, 3~4문장)",
    "objective": "객관적 탐구 질문 1개 (그림에서 보이는 사실 찾기)",
    "subjective": "주관적 탐구 질문 1개 (느낌이나 상상 묻기)",
    "evaluative": "평가적 탐구 질문 1개 (작가의 의도나 자신의 생각 판단하기)"
  },
  { ...두 번째 작품... },
  { ...세 번째 작품... }
]
`;

    try {
        // 구글 Gemini Pro API 호출 (옵션 B 적용)
        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        const data = await apiResponse.json();

        // API 응답 에러 처리
        if (!apiResponse.ok) {
            console.error('Google API 통신 에러:', data);
            return res.status(500).json({ error: '구글 API 호출 중 오류가 발생했습니다.', details: data });
        }

        // 텍스트 추출 및 마크다운 잔재 제거
        let responseText = data.candidates[0].content.parts[0].text;
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        // JSON 파싱 후 프런트엔드로 전달
        const parsedData = JSON.parse(responseText);
        return res.status(200).json(parsedData);

    } catch (error) {
        console.error('서버 내부 에러:', error);
        return res.status(500).json({ error: '서버에서 데이터를 처리하는 중 오류가 발생했습니다.', message: error.message });
    }
};
