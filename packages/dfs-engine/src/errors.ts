export class DfsDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DfsDefinitionError';
  }
}

export class DfsEngineInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DfsEngineInvariantError';
  }
}
