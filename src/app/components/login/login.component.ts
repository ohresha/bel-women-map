import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { FirebaseService } from '../../services/firebase.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly firebaseService = inject(FirebaseService);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected isSubmitting = false;
  protected authError = '';

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.authError = '';

    try {
      const { email, password } = this.form.getRawValue();
      await this.firebaseService.login(email, password);
      await this.router.navigate(['/admin']);
    } catch (error) {
      this.authError = this.getErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-email':
          return 'Неверный логин или пароль.';
        case 'auth/too-many-requests':
          return 'Слишком много попыток входа. Попробуйте позже.';
        default:
          return 'Не удалось выполнить вход. Проверьте настройки Firebase.';
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Произошла непредвиденная ошибка авторизации.';
  }
}
