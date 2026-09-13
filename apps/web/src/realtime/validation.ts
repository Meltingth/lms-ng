import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import envelope from '../../../../contracts/json-schema/ws/envelope.schema.json';
import messages from '../../../../contracts/json-schema/ws/messages.schema.json';
import enums from '../../../../contracts/json-schema/common/enums.schema.json';
import ids from '../../../../contracts/json-schema/common/ids.schema.json';
import time from '../../../../contracts/json-schema/common/time.schema.json';
import type { Frame, FrameType } from '../model/types';

const ajv = new Ajv2020({ allErrors: true, strict: false });
// The legacy root validator keeps Ajv 8.17; this frontend uses a patched Ajv 8.x instance.
addFormats(ajv as unknown as Parameters<typeof addFormats>[0]);
for (const schema of [enums, ids, time, messages, envelope]) ajv.addSchema(schema);
const dispatch: Record<FrameType, string> = {
  snapshot: 'snapshotData', 'elevator.state': 'elevatorStateData', 'elevator.status': 'elevatorStatusDeltaData',
  'gateway.status': 'gatewayStatusData', 'source.changed': 'sourceChangedData', error: 'errorData',
  subscribe: 'subscribeData', beacon: 'beaconData', pong: 'pongData',
};
const validateEnvelope = ajv.getSchema(envelope.$id)!;
const validators = Object.fromEntries(Object.entries(dispatch).map(([kind, name]) =>
  [kind, ajv.compile({ $ref: `${messages.$id}#/$defs/${name}` })]));

export function validateFrame(value: unknown): { frame: Frame; error: null } | { frame: null; error: string } {
  if (!validateEnvelope(value)) return { frame: null, error: ajv.errorsText(validateEnvelope.errors) };
  const input = value as Frame;
  const validateData = validators[input.type];
  if (!validateData(input.data)) return { frame: null, error: ajv.errorsText(validateData.errors) };
  return { frame: structuredClone(input), error: null };
}
