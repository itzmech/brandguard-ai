import type { Template } from '../types';

type TemplatesViewProps = {
  onSelectTemplate: (content: string) => void;
};

const defaultTemplates: Template[] = [
  {
    id: 'tpl-1',
    title: 'High Violations Test Copy',
    category: 'Benchmark Test',
    description: 'A marketing blurb heavy in unverified medical claims, extreme superlatives, and high urgency.',
    content:
      'Our miracle cream is 100% guaranteed to cure acne in 3 days! Act now, limited time only! This revolutionary formula will eliminate all your skin problems forever. No other product on the market can match our results!',
  },
  {
    id: 'tpl-2',
    title: 'Health & Supplement Ad Copy',
    category: 'Regulatory Risk',
    description: 'Contains health and lifestyle promises, absolute claims, and unproven certification claims.',
    content:
      'Get rich quick with our amazing supplement! This doctor-approved formula has absolutely no side effects and will boost your energy by 500%. Lose 30 pounds in 2 weeks without exercise! FDA-approved and scientifically proven to work for everyone. Order now before it is too late!',
  },
  {
    id: 'tpl-3',
    title: 'Compliant Product Launch',
    category: 'Compliant Baseline',
    description: 'Clean, brand-aligned marketing text adhering to substantiation and safe claim standards.',
    content:
      'Introducing our new skincare line, carefully formulated with natural ingredients. Many customers have reported improved skin texture after regular use. Results may vary based on individual skin type. Consult with a dermatologist for personalized advice. Visit our website to learn more about our products.',
  },
  {
    id: 'tpl-4',
    title: 'SaaS Feature Announcement',
    category: 'B2B Marketing',
    description: 'Product release email for business software highlighting team collaboration improvements.',
    content:
      'We are excited to share new features built to improve collaboration across distributed teams. Our latest release includes real-time notifications, unified search, and audit trails. Learn more about how teams use BrandGuard to safeguard customer trust.',
  },
  {
    id: 'tpl-5',
    title: 'Landing Page Hero Copy',
    category: 'Web Copy',
    description: 'High-converting headline and subheadline with balanced, trustworthy value propositions.',
    content:
      'Empower your team with intuitive workflows and clear project visibility. Trusted by forward-thinking teams globally to streamline compliance without slowing down delivery.',
  },
];

export function TemplatesView({ onSelectTemplate }: TemplatesViewProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {defaultTemplates.map((template) => (
          <div
            key={template.id}
            className="bg-white rounded-xl border border-border-default p-5 shadow-sm hover:border-primary-blue/50 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-primary-blue bg-blue-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {template.category}
                </span>
              </div>
              <h3 className="text-base font-bold text-text-primary mb-2">
                {template.title}
              </h3>
              <p className="text-xs text-text-secondary mb-4 leading-relaxed">
                {template.description}
              </p>

              {/* Sample snippet */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs text-text-secondary font-mono leading-relaxed line-clamp-3 mb-4">
                &ldquo;{template.content}&rdquo;
              </div>
            </div>

            <button
              onClick={() => onSelectTemplate(template.content)}
              className="w-full bg-white hover:bg-slate-50 text-primary-blue hover:text-blue-hover border border-primary-blue/30 hover:border-primary-blue py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Use Template</span>
              <span>→</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
