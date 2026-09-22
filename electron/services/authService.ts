import Database from 'better-sqlite3';
import { AppDatabase } from '../database';

export class AuthService {
  private db: Database.Database;
  private isAuthenticated: boolean = false;

  constructor(database: AppDatabase) {
    this.db = database.getDatabase();
  }

  login(username: string, password: string): boolean {
    const admin = this.db
      .prepare('SELECT * FROM admin WHERE username = ? AND password = ?')
      .get(username, password) as any;

    if (admin) {
      this.isAuthenticated = true;
      return true;
    }
    return false;
  }

  checkAuth(): boolean {
    return this.isAuthenticated;
  }

  logout(): void {
    this.isAuthenticated = false;
  }
}

