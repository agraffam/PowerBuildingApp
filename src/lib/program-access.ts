/** System templates have no owner; users may view/activate/duplicate only. */
export function userCanViewProgram(ownerId: string | null, userId: string): boolean {
  return ownerId === null || ownerId === userId;
}

export function userCanEditProgramStructure(ownerId: string | null, userId: string): boolean {
  return ownerId != null && ownerId === userId;
}
