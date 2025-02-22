import { IEventInstance, IOPEvent } from '@apitable/core';

export type FormSubmittedEvent = Omit<IEventInstance<IOPEvent>, 'context'> & {
  context: FormSubmittedEventContext,
} & {
  beforeApply: boolean,
};

export type FormSubmittedEventContext = {
  formId: string,
  recordId: string,
  [key: string]: any,
};