// blueprint-app/server/src/tests/checkoutHref.test.ts
//
// Unit tests for the frontend checkout wiring (`src/lib/pricing.ts`): the hosted
// Stripe Payment Links used by the landing and account CTAs, and the
// `client_reference_id` stamping that tells the webhook WHO paid.
//
// No network and no Stripe account: these assert on the URLs the UI produces.
// Run with: npm run test:pricing

import assert from 'node:assert/strict';
import { PRICING, BLUEPRINT_PLANS, checkoutHref } from '../../../src/lib/pricing.js';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failures.push(name);
    console.error(`  ✗ ${name}\n    ${err?.message ?? err}`);
  }
}

const SOLO_MONTHLY = 'https://buy.stripe.com/bJefZh06XeV9dMC1Cw9Zm00';
const SOLO_YEARLY = 'https://buy.stripe.com/28E00j6vl6oDbEucha9Zm01';
const TEAM_MONTHLY = 'https://buy.stripe.com/eVq3cvdXN7sH5g6dle9Zm02';
const TEAM_YEARLY = 'https://buy.stripe.com/3cIdR9f1R7sH4c20ys9Zm03';
const USER_ID = 'usr_abc123';

console.log('\nPlan catalog');

const expected: [string, string, string][] = [
  ['solo monthly', PRICING.blueprint.solo.href, SOLO_MONTHLY],
  ['solo yearly', PRICING.blueprint.solo.yearlyHref!, SOLO_YEARLY],
  ['team monthly', PRICING.blueprint.team.href, TEAM_MONTHLY],
  ['team yearly', PRICING.blueprint.team.yearlyHref!, TEAM_YEARLY],
];

for (const [label, actual, want] of expected) {
  test(`${label} link is ${want}`, () => {
    assert.equal(actual, want);
  });
}

test('Agency is "Contact for pricing" with a visible sales address', () => {
  const agency = PRICING.blueprint.agency;
  assert.equal(agency.href, 'mailto:sales@nuria.firstcreationmedia.com');
  assert.equal(agency.contactEmail, 'sales@nuria.firstcreationmedia.com');
  assert.equal(agency.price, 'Contact for pricing');
});

test('Free plan sends people to signup, never to Stripe', () => {
  assert.equal(PRICING.blueprint.free.href, '/signup');
  assert.ok(!PRICING.blueprint.free.href.startsWith('https://buy.stripe.com/'));
});

test('no dead/legacy Stripe links remain in the catalog', () => {
  const hrefs = JSON.stringify(BLUEPRINT_PLANS);
  assert.ok(!hrefs.includes('6oU28r'), 'an old buy.stripe.com/6oU28r… link is still present');
  // Every Stripe link must be one of the four current Blueprint links.
  const stripeLinks = (hrefs.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g) ?? []);
  for (const link of stripeLinks) {
    assert.ok([SOLO_MONTHLY, SOLO_YEARLY, TEAM_MONTHLY, TEAM_YEARLY].includes(link), `unexpected Stripe link ${link}`);
  }
});

console.log('\nclient_reference_id stamping');

test('signed-in: monthly link gains ?client_reference_id=<userId>', () => {
  assert.equal(
    checkoutHref(SOLO_MONTHLY, USER_ID),
    `${SOLO_MONTHLY}?client_reference_id=${encodeURIComponent(USER_ID)}`
  );
});

test('signed-in: yearly link gains ?client_reference_id=<userId>', () => {
  assert.equal(
    checkoutHref(TEAM_YEARLY, USER_ID),
    `${TEAM_YEARLY}?client_reference_id=${encodeURIComponent(USER_ID)}`
  );
});

test('the user id is URL-encoded', () => {
  assert.equal(
    checkoutHref(SOLO_MONTHLY, 'a b&c'),
    `${SOLO_MONTHLY}?client_reference_id=${encodeURIComponent('a b&c')}`
  );
});

test('anonymous: link is returned unchanged (landing pages use /signup instead)', () => {
  assert.equal(checkoutHref(SOLO_MONTHLY, undefined), SOLO_MONTHLY);
  assert.equal(checkoutHref(SOLO_MONTHLY, null), SOLO_MONTHLY);
  assert.equal(checkoutHref(SOLO_MONTHLY, ''), SOLO_MONTHLY);
});

test('non-Stripe hrefs (mailto, internal, anchor) are never stamped', () => {
  const mailto = 'mailto:sales@nuria.firstcreationmedia.com';
  assert.equal(checkoutHref(mailto, USER_ID), mailto);
  assert.equal(checkoutHref('/signup', USER_ID), '/signup');
  assert.equal(checkoutHref('#pricing', USER_ID), '#pricing');
});

test('undefined href stays undefined', () => {
  assert.equal(checkoutHref(undefined, USER_ID), undefined);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error('Failing tests:', failures.join('; '));
  process.exit(1);
}
