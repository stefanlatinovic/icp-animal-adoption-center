import {
  Canister,
  Record,
  text,
  nat8,
  nat64,
  Principal,
  Opt,
  None,
  Some,
  Variant,
  StableBTreeMap,
  update,
  Result,
  Err,
  Ok,
  ic,
} from "azle";
import { v4 as uuidv4 } from "uuid";

/**
 * Enumeration for adoption statuses
 */
enum AdoptionStatus {
  // Animal is available for adoption
  Available = "available",
  // Animal currently is not available for adoption
  OnHold = "on hold",
  // Animal is adopted
  Adopted = "adopted",
}

/**
 * Enumeration for gender options
 */
enum Gender {
  // Male
  Male = "male",
  // Female
  Female = "female",
}

/**
 * This type represents an animal
 */
const Animal = Record({
  name: text,
  species: text,
  breed: text,
  gender: text,
  age: nat8,
  description: text,
});

type Animal = typeof Animal.tsType;

/**
 * This type represents an adoption listing
 */
const AdoptionListing = Record({
  id: text,
  animal: Animal,
  adoptionStatus: text,
  listedBy: Principal,
  listedAt: nat64,
  updatedAt: Opt(nat64),
});

type AdoptionListing = typeof AdoptionListing.tsType;

/**
 * This type represents an adoption listing payload
 */
const AdoptionListingPayload = Record({
  name: text,
  species: text,
  breed: text,
  gender: text,
  age: nat8,
  description: text,
});

/**
 * This type represents Error variant
 */
const Error = Variant({
  Forbidden: text,
  NotFound: text,
  BadRequest: text,
});

// Storage variables
const adoptionListings = StableBTreeMap<text, AdoptionListing>(0);

export default Canister({
  /**
   * Lists animal for adoption
   * @param payload - Payload for listing for adoption
   * @returns created adoption listing or an error
   */
  listForAdoption: update(
    [AdoptionListingPayload],
    Result(AdoptionListing, Error),
    (payload) => {
      // Validate adoption listing payload
      const err: Opt<Error> = validateAdoptionListingPayload(payload);
      if (err.Some) {
        return err.Some;
      }

      // Generate adoption listing identifier
      const id = uuidv4();

      // Populate adoption listing
      const adoptionListing: AdoptionListing = {
        id: id,
        animal: {
          name: payload.name,
          species: payload.species,
          breed: payload.breed,
          gender: payload.gender,
          age: payload.age,
          description: payload.description,
        },
        adoptionStatus: AdoptionStatus.Available,
        listedBy: ic.caller(),
        listedAt: ic.time(),
        updatedAt: None,
      };

      // Store adoption listing
      adoptionListings.insert(adoptionListing.id, adoptionListing);

      return Ok(adoptionListing);
    }
  ),
});

/**
 * Validates adoption listing payload
 * @param payload - Payload for adoption listing
 * @returns optional error
 */
function validateAdoptionListingPayload(
  payload: typeof AdoptionListingPayload
): Opt<Error> {
  // Validate missing fields
  if (!payload.species) {
    return Some(Err({ BadRequest: "species is missing" }));
  }
  if (!payload.breed) {
    return Some(Err({ BadRequest: "breed is missing" }));
  }
  if (!payload.gender) {
    return Some(Err({ BadRequest: "gender is missing" }));
  }
  if (!payload.age) {
    return Some(Err({ BadRequest: "age is missing" }));
  }

  // Validate invalid fields
  if (!Object.values(Gender).includes(payload.gender as unknown as Gender)) {
    return Some(Err({ BadRequest: "invalid gender" }));
  }

  return None;
}

// Mocking the 'crypto' object for testing purposes
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
