import type { FormEvent } from 'react';
import type { FieldValues, UseFormHandleSubmit } from 'react-hook-form';

/** React Hook Form discards callback return values; preserve the actual outcome for feedback. */
export function validatedSubmit<Input extends FieldValues, Output extends FieldValues = Input>(
  handleSubmit: UseFormHandleSubmit<Input, Output>,
  action: (values: Output) => unknown | Promise<unknown>,
) {
  return async (event: FormEvent<HTMLFormElement>) => {
    let accepted = false;
    await handleSubmit(async (values) => { accepted = (await action(values)) !== false; })(event);
    return accepted;
  };
}
