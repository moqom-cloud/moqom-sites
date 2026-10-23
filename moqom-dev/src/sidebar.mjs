// Shared by astro.config.mjs and the llms.txt endpoints, so both list pages in the same order.
export const sidebar = [
	{
		label: 'Getting started',
		items: [
			{ label: 'What is MOQOM?', slug: 'getting-started/what-is-moqom' },
			{ label: 'How MOQOM compares', slug: 'getting-started/compare' },
			{ label: 'Concepts', slug: 'getting-started/concepts' },
			{ label: '5-minute quickstart', slug: 'getting-started/quickstart' },
		],
	},
	{
		label: 'Guides',
		items: [
			{ label: 'iOS & macOS (Swift)', slug: 'guides/ios-macos' },
			{ label: 'Backend: Go', slug: 'guides/backend-go' },
			{ label: 'Backend: Rust', slug: 'guides/backend-rust' },
			{ label: 'API keys', slug: 'guides/api-keys' },
			{ label: 'Presence', slug: 'guides/presence' },
			{ label: 'Moderation', slug: 'guides/moderation' },
			{ label: 'AI agents', slug: 'guides/ai-agents' },
			{ label: 'End-to-end encryption', slug: 'guides/e2ee' },
			{ label: 'Recording', slug: 'guides/recording' },
			{ label: 'Shared AR spaces', slug: 'guides/ar-space' },
			{ label: 'Unreliable networks', slug: 'guides/unreliable-networks' },
			{ label: 'Self-hosting relays', slug: 'guides/self-hosting' },
			{ label: 'Private relay networks', slug: 'guides/private-networks' },
			{ label: 'Point-to-point calls', slug: 'guides/peer-to-peer' },
			{ label: 'Cloudflare MoQ relays', slug: 'guides/cloudflare' },
			{ label: 'Events, webhooks & billing', slug: 'guides/events-and-billing' },
			{ label: 'Spend limits & alerts', slug: 'guides/spend-limits-and-alerts' },
			{ label: 'Live connections map', slug: 'guides/live-map' },
			{ label: 'Migrating from Agora', slug: 'guides/migrate-from-agora' },
		],
	},
	{
		label: 'API reference',
		items: [
			{ label: 'Admin API overview', slug: 'reference/admin-api' },
			{ label: 'Billing & keys REST API', slug: 'reference/billing-api' },
			{ label: 'Usage reporting API', slug: 'reference/usage-api' },
			{ label: 'Control-plane gRPC API', slug: 'reference/control-plane-grpc' },
			{ label: 'Getting a token onto a device', slug: 'reference/device-tokens' },
			{ label: 'Error codes', slug: 'reference/errors' },
		],
	},
	{
		label: 'Billing',
		items: [
			{ label: 'Pricing model', slug: 'billing/pricing' },
			{ label: 'Tiers & rates', slug: 'billing/tiers' },
			{ label: 'Top-ups & auto top-up', slug: 'billing/top-ups' },
			{ label: 'Self-hosted fee', slug: 'billing/self-hosted' },
		],
	},
	{
		label: 'Architecture',
		items: [
			{ label: 'Overview', slug: 'architecture/overview' },
			{ label: 'Control plane vs media plane', slug: 'architecture/planes' },
			{ label: 'Standards', slug: 'architecture/standards' },
			{ label: 'Draft-23 proposals', slug: 'architecture/draft-23-proposals' },
		],
	},
	{
		label: 'Specs & benchmarks',
		items: [
			{ label: 'Benchmarks', slug: 'specs/benchmarks' },
			{ label: 'Specifications', slug: 'specs/specifications' },
			{ label: 'Methodology', slug: 'specs/methodology' },
			{ label: 'Proposal: hop limit for relays', slug: 'specs/relay-hops-proposal' },
		],
	},
	{
		label: 'Security',
		items: [
			{ label: 'Threat model & controls', slug: 'security/overview' },
			{ label: 'Post-quantum authentication', slug: 'security/post-quantum' },
			{
				label: 'Security libraries',
				items: [
					{ label: 'Overview', slug: 'security/libraries' },
					{ label: 'Device-bound sign-in', slug: 'security/libraries/device-sign-in' },
					{ label: 'Replace your JWTs', slug: 'security/libraries/replace-jwt' },
					{ label: 'moqom-token', slug: 'security/libraries/token' },
					{ label: 'moqom-proof', slug: 'security/libraries/proof' },
					{ label: 'moqom-sframe', slug: 'security/libraries/sframe' },
					{ label: 'moqom-mls', slug: 'security/libraries/mls' },
				],
			},
			{ label: 'Responsible disclosure', slug: 'security/disclosure' },
		],
	},
	{
		label: 'Platforms',
		items: [
			{ label: 'Platform status', slug: 'platforms/status' },
			{ label: 'Android', slug: 'platforms/android' },
			{ label: 'Desktop', slug: 'platforms/desktop' },
			{ label: 'OBS plugin', slug: 'platforms/obs' },
		],
	},
	{
		label: 'Community',
		items: [{ label: 'Contributing', slug: 'community/contributing' }],
	},
	{ label: 'Changelog', slug: 'changelog' },
];
