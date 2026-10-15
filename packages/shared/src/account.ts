import { z } from 'zod';

/**
 * The account deletion form: the password re-authenticates the user and the
 * explicit acknowledgement makes the irreversible step deliberate. Only the
 * password is sent on to the delete-account function (same limits as its
 * request contract, with form-friendly error codes).
 */
export const deleteAccountFormSchema = z.object({
  password: z.string().min(1, { error: 'required' }).max(1024, { error: 'passwordTooLong' }),
  confirm: z.literal(true, { error: 'confirmRequired' }),
});

export type DeleteAccountFormInput = z.input<typeof deleteAccountFormSchema>;
