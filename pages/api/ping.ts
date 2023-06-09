// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import { zip } from 'zip-a-folder';
import { EnvObj } from '@/components/env';
import { Schema } from '@/components/schema';
import ServerGenerator from '@/helper/ServerGenerator';

interface ExtendedNextApiRequest extends NextApiRequest {
  body: RequestBody
}

export interface RequestBody {
  env: EnvObj[];
  schema: Schema;
};

export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse<any>
) {
  res.send("pong")
}
