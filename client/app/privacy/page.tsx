import { LegalPage } from '@/components/legal-page';
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy summarizes how KaziLedger handles account, identity, service and payment information."
      sections={[
        [
          'Information collected',
          'We process account identifiers, contact details, service requests, expert applications, verification documents, consent preferences and transaction references needed to operate the platform.',
        ],
        [
          'How information is used',
          'Information supports authentication, expert verification, matching, quoting, payment status, dispute resolution, fraud prevention and required service notifications.',
        ],
        [
          'Sensitive documents',
          'Identity, tax and professional documents are treated as sensitive. Access is restricted to administrators with explicit document-view permissions and files are stored privately.',
        ],
        [
          'Payments',
          'Raw mobile-money credentials are not stored by KaziLedger. Payment processing and status verification are handled through Pesapal using provider transaction references.',
        ],
        [
          'Your choices',
          'Marketing messages require opt-in consent. Transactional notices necessary to deliver a requested service may still be sent. Contact support@kaziledger.example for privacy requests.',
        ],
      ]}
    />
  );
}
