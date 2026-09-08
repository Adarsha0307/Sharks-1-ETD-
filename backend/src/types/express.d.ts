declare namespace Express {
  interface Request {
    requestId: string;
    auth?: {
      userId: string;
      username: string;
      sessionId: string;
      csrfHash: string;
    };
  }
}
