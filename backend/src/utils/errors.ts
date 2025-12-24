export class QuotaExceededError extends Error {
  constructor(message: string = 'Daily upload limit exceeded') {
    super(message);
    this.name = 'QuotaExceededError';
    Object.setPrototypeOf(this, QuotaExceededError.prototype);
  }
}

