import { unauthorized } from '../errors.js';

export const TOKEN_COOKIE = 'token';

// Токен беремо з httpOnly-cookie (браузер) або з заголовка
// Authorization: Bearer ... (Postman, тести).
export function makeRequireAuth(authService) {
  return function requireAuth(req, _res, next) {
    try {
      const header = req.headers.authorization;
      const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
      const token = req.cookies?.[TOKEN_COOKIE] || bearer;
      if (!token) throw unauthorized();
      req.userId = authService.verifyToken(token).userId;
      next();
    } catch (err) {
      next(err);
    }
  };
}
