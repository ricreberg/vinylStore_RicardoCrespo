import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabase = createClient(
    environment.supabaseUrl,
    environment.supabaseKey,
  );

  signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
  }

  signOut() {
    return this.supabase.auth.signOut({ scope: 'local' });
  }

  getSession() {
    return this.supabase.auth.getSession();
  }
}