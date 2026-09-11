import { LegalPage } from '@/components/legal-page';
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms explain how clients, experts and administrators may use KaziLedger."
      sections={[
        [
          'Service engagements',
          'KaziLedger facilitates matching, quoting, escrow tracking and delivery records. Experts remain independent service providers responsible for the professional services they perform.',
        ],
        [
          'Payments and escrow',
          'Only quoted labour fees are collected through the platform. Statutory fees and separately agreed deposits are outside platform escrow. Funds may be held during the configured delivery review or dispute period.',
        ],
        [
          'User responsibilities',
          'Users must provide accurate information, protect their account credentials, respect confidentiality and use the platform only for lawful professional-service engagements.',
        ],
        [
          'Disputes',
          'A client may raise a dispute before the release window expires. The platform may review records and evidence and apply a release, hold or partial resolution.',
        ],
        [
          'Contact',
          'Questions about these terms can be sent to support@kaziledger.example.',
        ],
      ]}
    />
  );
}
