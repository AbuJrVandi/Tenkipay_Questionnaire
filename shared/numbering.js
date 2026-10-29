export const numberQuestions = questions => questions.map((q, index) => ({ ...q, number: String(index + 1) }));
