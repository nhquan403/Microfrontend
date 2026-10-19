import { routes } from './remote.routes';

describe('remote contract', () => {
  it('exposes Angular routes with a default page and an item page', () => {
    expect(routes.map((r) => r.path)).toEqual(['', 'items/:id']);
    expect(routes.every((r) => r.component)).toBe(true);
  });
});
