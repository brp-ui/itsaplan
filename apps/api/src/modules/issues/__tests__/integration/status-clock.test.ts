import { beforeEach, expect, it } from 'bun:test';
import { db, issueActivity, issueStatus } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

beforeEach(resetDb);

it('keeps status changes and their feed entries ordered after the clock moves backward', async () => {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  const columns = (await api.projects({ projectKey: 'MKT' }).get()).data!.columns;
  const issue = (
    await api
      .projects({ projectKey: 'MKT' })
      .issues.post({ columnId: columns[0].id, title: 'Task' })
  ).data!;
  const future = new Date(Date.now() + 10_000);
  await db.update(issueStatus).set({ enteredAt: future }).where(eq(issueStatus.issueId, issue.id));
  await db
    .update(issueActivity)
    .set({ createdAt: future })
    .where(eq(issueActivity.issueId, issue.id));

  expect((await api.issues({ issueId: issue.id }).patch({ columnId: columns[1].id })).status).toBe(
    200,
  );
  expect((await api.issues({ issueId: issue.id }).patch({ columnId: columns[0].id })).status).toBe(
    200,
  );

  const groups = (await api.issues({ issueId: issue.id }).feed.grouped.get()).data!.groups;
  expect(groups.map((group) => group.status)).toEqual([
    columns[0].name,
    columns[1].name,
    columns[0].name,
  ]);
  expect(groups.map((group) => group.repeat)).toEqual([true, false, false]);
  expect(groups.map((group) => group.items.map((item) => item.action))).toEqual([
    ['status'],
    ['status'],
    ['created'],
  ]);
});
