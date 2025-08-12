import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log request start
  console.log(`📥 ${req.method} ${req.path}`, {
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    body: req.method !== 'GET' && Object.keys(req.body || {}).length > 0 ? 
      { ...req.body, password: req.body.password ? '[REDACTED]' : undefined } : undefined
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    console.log(`📤 ${req.method} ${req.path} - ${res.statusCode}`, {
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      responseSize: JSON.stringify(body).length
    });
    
    return originalJson.call(this, body);
  };

  next();
};