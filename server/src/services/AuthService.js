import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { conflict, unauthorized } from '../errors.js';

const BCRYPT_COST = 10;

// Хеш для порівняння, коли користувача не знайдено: час відповіді
// не відрізняється, і за ним не можна дізнатися, чи існує email.
const DUMMY_HASH = bcrypt.hashSync('mycelia-dummy-password', BCRYPT_COST);

// Сервіс (SOA): усе, що стосується облікових записів і токенів.
// Залежності передаються ззовні, тому сервіс легко тестувати.
export class AuthService {
  constructor({ userRepository, jwtSecret, jwtExpiresSeconds }) {
    this.users = userRepository;
    this.secret = jwtSecret;
    this.expiresIn = jwtExpiresSeconds;
  }

  async register({ email, password }) {
    if (await this.users.findByEmail(email)) {
      throw conflict('Користувач із таким email уже існує');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await this.users.create({ email, passwordHash });
    return this.#publicUser(user);
  }

  async login({ email, password }) {
    const user = await this.users.findByEmail(email);
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) throw unauthorized('Невірний email або пароль');
    return this.#publicUser(user);
  }

  issueToken(user) {
    return jwt.sign({ sub: user.id }, this.secret, {
      expiresIn: this.expiresIn,
      algorithm: 'HS256',
    });
  }

  verifyToken(token) {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
      return { userId: payload.sub };
    } catch {
      throw unauthorized('Недійсний або прострочений токен');
    }
  }

  async getUser(id) {
    const user = await this.users.findById(id);
    if (!user) throw unauthorized();
    return this.#publicUser(user);
  }

  #publicUser(user) {
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
