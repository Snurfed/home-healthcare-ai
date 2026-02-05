/**
 * LoginForm Component
 *
 * Authentication form with email and password
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin } from '@hooks/index';
import { Button, Input, Alert } from '@components/common';
import { getErrorMessage } from '@services/index';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess?: () => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);

    try {
      await loginMutation.mutateAsync(data);
      onSuccess?.();
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <Alert
          variant="error"
          onClose={() => setServerError(null)}
        >
          {serverError}
        </Alert>
      )}

      <Input
        {...register('email')}
        type="email"
        label="Email Address"
        placeholder="nurse@example.com"
        error={errors.email?.message}
        autoComplete="email"
        autoFocus
      />

      <Input
        {...register('password')}
        type="password"
        label="Password"
        placeholder="Enter your password"
        error={errors.password?.message}
        autoComplete="current-password"
      />

      <Button
        type="submit"
        fullWidth
        isLoading={isSubmitting || loginMutation.isLoading}
      >
        Sign In
      </Button>
    </form>
  );
}
