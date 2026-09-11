import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react';

type StaticLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children?: ReactNode;
};

/**
 * A normal document link for the FastAPI-hosted static export.
 *
 * Vinext's Next-compatible Link attempts RSC navigation. That runtime belongs
 * to the Vinext server and is intentionally absent when FastAPI serves HTML.
 */
const StaticLink = forwardRef<HTMLAnchorElement, StaticLinkProps>(
  ({ children, href, ...props }, ref) => (
    <a ref={ref} href={href} {...props}>
      {children}
    </a>
  ),
);

StaticLink.displayName = 'StaticLink';

export default StaticLink;
