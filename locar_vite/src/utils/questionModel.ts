let openModalExternal: ((question: string) => Promise<string>) | null = null;

export function registerQuestionOpener(
  fn: (question: string) => Promise<string>
) {
  openModalExternal = fn;
}

export function askQuestion(question: string): Promise<string> {
  if (!openModalExternal) {
    throw new Error("QuestionBox is not mounted yet.");
  }
  return openModalExternal(question);
}
