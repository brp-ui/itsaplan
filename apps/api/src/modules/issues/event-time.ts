import { issueActivity, issueStatus } from '@repo/db';
import { inArray, sql } from 'drizzle-orm';

// Keep causal order, including at the public API's millisecond precision, when the
// database clock is corrected backward or successive writes share a millisecond.
export function nextIssueEventTime(issueIds: number[]) {
  return sql<Date>`greatest(
    now(),
    (select max(${issueStatus.enteredAt}) + interval '1 millisecond'
     from ${issueStatus} where ${inArray(issueStatus.issueId, issueIds)}),
    (select max(${issueActivity.createdAt}) + interval '1 millisecond'
     from ${issueActivity} where ${inArray(issueActivity.issueId, issueIds)})
  )`;
}
