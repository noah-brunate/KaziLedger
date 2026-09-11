export type PublicService = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  suitableFor: string;
  includes: string[];
};

export const publicServices: PublicService[] = [
  {
    slug: 'monthly-bookkeeping',
    name: 'Monthly bookkeeping',
    summary: 'Keep your records current, reconciled, and ready for decisions.',
    description:
      'Work with a vetted bookkeeping expert to organise sales, expenses, bank activity, and supporting records into a clear monthly view of your business.',
    suitableFor: 'Businesses that need dependable records without hiring a full-time bookkeeper.',
    includes: ['Transaction categorisation', 'Bank and mobile-money reconciliation', 'Monthly records summary', 'A clear list of missing information'],
  },
  {
    slug: 'tax-preparation',
    name: 'Tax preparation',
    summary: 'Prepare returns and compliance records with expert guidance.',
    description:
      'A tax and compliance professional will help you organise the information needed for a return, identify outstanding records, and prepare your filing work for review.',
    suitableFor: 'Businesses and individuals preparing routine tax returns or catching up on compliance work.',
    includes: ['Records checklist', 'Return preparation support', 'Compliance review', 'Guidance on statutory charges'],
  },
  {
    slug: 'business-registration',
    name: 'Business registration',
    summary: 'Understand the registration process and prepare each required step.',
    description:
      'Get practical support through the registration process, with professional labour fees separated from government and statutory charges before you proceed.',
    suitableFor: 'New businesses formalising their operations or updating registration details.',
    includes: ['Registration requirements review', 'Document preparation checklist', 'Process guidance', 'Clear separation of labour and statutory fees'],
  },
  {
    slug: 'payroll-management',
    name: 'Payroll management',
    summary: 'Run payroll with clear deductions, schedules, and employee records.',
    description:
      'An experienced payroll specialist can prepare pay schedules and help keep statutory deductions and supporting records organised for each pay period.',
    suitableFor: 'Employers who need recurring payroll support and stronger record keeping.',
    includes: ['Payroll schedule preparation', 'Statutory deduction calculations', 'Employee payment records', 'Period-end payroll summary'],
  },
];

export function getPublicService(slug: string): PublicService | undefined {
  return publicServices.find((service) => service.slug === slug);
}
