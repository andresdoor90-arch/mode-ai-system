import { type CollectionId, type GarmentId } from '../../shared/Identifier';
import { type IdGenerator } from '../../shared/IdGenerator';
import { type Result, ok } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { WardrobeCollection } from '../../domain/entities/WardrobeCollection';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { type ICollectionRepository } from '../../domain/repositories/ICollectionRepository';
import { type Command, type RequestHandler } from '../bus/types';

export const CREATE_COLLECTION = 'collection.create';

export interface CreateCollectionInput {
  readonly name: string;
  readonly description?: string;
  readonly garmentIds?: readonly GarmentId[];
}

/** Create a named collection, ensuring every referenced garment exists. */
export class CreateCollectionCommand implements Command<CollectionId> {
  public readonly type = CREATE_COLLECTION;
  public constructor(public readonly input: CreateCollectionInput) {}
}

export class CreateCollectionHandler implements RequestHandler<
  CreateCollectionCommand,
  CollectionId
> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly collections: ICollectionRepository,
    private readonly ids: IdGenerator,
  ) {}

  public async handle(command: CreateCollectionCommand): Promise<Result<CollectionId>> {
    const garmentIds = command.input.garmentIds ?? [];
    for (const garmentId of garmentIds) {
      const garment = await this.garments.findById(garmentId);
      if (garment === null) {
        return {
          ok: false,
          error: new ValidationError(`Cannot add missing garment ${garmentId} to a collection.`),
        };
      }
    }

    const id = this.ids.next<'Collection'>();
    const created = WardrobeCollection.create(id, {
      name: command.input.name,
      ...(command.input.description !== undefined
        ? { description: command.input.description }
        : {}),
      garmentIds: [...garmentIds],
    });
    if (!created.ok) {
      return created;
    }
    await this.collections.save(created.value);
    return ok(id);
  }
}
