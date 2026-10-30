import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';

import { SupabaseService } from './supabase.service';

export type UserRole = 'cliente' | 'admin';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly supabase = inject(SupabaseService).client;

  private readonly sessionState = signal<Session | null>(null);
  private readonly roleState = signal<UserRole | null>(null);
  private roleRequest = 0;

  readonly session = this.sessionState.asReadonly();
  readonly role = this.roleState.asReadonly();

  constructor() {
    const { data } = this.supabase.auth.onAuthStateChange(
      (_event, session) => {
        this.sessionState.set(session);
        this.roleState.set(null);

        const request = ++this.roleRequest;

        if (session) {
          const userId = session.user.id;

          setTimeout(() => {
            if (request === this.roleRequest) {
              void this.updateRole(userId, request);
            }
          }, 0);
        }
      },
    );

    this.destroyRef.onDestroy(() => {
      ++this.roleRequest;
      data.subscription.unsubscribe();
    });
  }

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

  async getRole(): Promise<UserRole | null> {
    const { data, error } = await this.supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!data.session) {
      return null;
    }

    return this.readRole(data.session.user.id);
  }

  private async readRole(userId: string): Promise<UserRole> {
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    const role: unknown = profile.role;

    if (role !== 'cliente' && role !== 'admin') {
      throw new Error('El perfil no tiene un rol válido.');
    }

    return role;
  }

  private async updateRole(
    userId: string,
    request: number,
  ): Promise<void> {
    try {
      const role = await this.readRole(userId);

      if (request === this.roleRequest) {
        this.roleState.set(role);
      }
    } catch {
      if (request === this.roleRequest) {
        this.roleState.set(null);
      }
    }
  }
}