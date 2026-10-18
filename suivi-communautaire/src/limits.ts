// Limites partagées par la validation serveur et les attributs maxlength des formulaires.
export const limits = {
  name: 160,
  email: 254,
  phone: 60,
  address: 300,
  note: 10000,
  nature: 160,
  participants: 2000,
  followUp: 2000,
  title: 160,
  label: 160,
  instruction: 500,
  fields: 30,
  options: 30,
  shortAnswer: 500,
  longAnswer: 10000,
  // Corps encodés maximaux par parcours.
  authBody: 16 * 1024,
  contentBody: 256 * 1024,
  pageSize: 25,
} as const;
