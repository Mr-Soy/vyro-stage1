const errorHandler = require('../server/middleware/errorHandler');

describe('errorHandler middleware', () => {
  let res;
  let jsonSpy;
  let statusSpy;

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    res = { status: statusSpy, json: jsonSpy };
  });

  it('should return 500 by default when no statusCode is set', () => {
    const err = new Error('Something broke');
    errorHandler(err, {}, res, () => {});

    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Something broke',
        }),
      })
    );
  });

  it('should use err.statusCode when provided', () => {
    const err = new Error('Not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    errorHandler(err, {}, res, () => {});

    expect(statusSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Not found',
        }),
      })
    );
  });

  it('should use err.status as fallback', () => {
    const err = new Error('Bad request');
    err.status = 400;
    errorHandler(err, {}, res, () => {});

    expect(statusSpy).toHaveBeenCalledWith(400);
  });

  it('should include stack trace in development mode', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = new Error('dev error');
    err.statusCode = 500;
    errorHandler(err, {}, res, () => {});

    const responseBody = jsonSpy.mock.calls[0][0];
    expect(responseBody.error.details).toBeDefined();
    expect(responseBody.error.details).toContain('dev error');

    process.env.NODE_ENV = origEnv;
  });

  it('should NOT include stack trace in production mode', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('prod error');
    err.statusCode = 500;
    errorHandler(err, {}, res, () => {});

    const responseBody = jsonSpy.mock.calls[0][0];
    expect(responseBody.error.details).toBeUndefined();

    process.env.NODE_ENV = origEnv;
  });

  it('should default error code to INTERNAL_ERROR', () => {
    const err = new Error('no code');
    errorHandler(err, {}, res, () => {});

    const responseBody = jsonSpy.mock.calls[0][0];
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });

  it('should always set success: false', () => {
    const err = new Error('any');
    errorHandler(err, {}, res, () => {});

    const responseBody = jsonSpy.mock.calls[0][0];
    expect(responseBody.success).toBe(false);
  });
});
