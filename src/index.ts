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
  query,
  Result,
  Err,
  Ok,
  ic,
  Vec,
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
 * Enumeration for adoption request statuses
 */
enum AdoptionRequestStatus {
  // Adoption request is created and is in pending state
  Pending = "pending",
  // Adoption request is approved
  Approved = "approved",
  // Adoption request is rejected
  Rejected = "rejected",
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
 * This type represents an adoption request
 */
const AdoptionRequest = Record({
  id: text,
  adoptionListingId: text,
  adoptionRequestStatus: text,
  submittedBy: Principal,
  submittedAt: nat64,
  updatedAt: Opt(nat64),
});

type AdoptionRequest = typeof AdoptionRequest.tsType;

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
const adoptionRequests = StableBTreeMap<text, AdoptionRequest>(0);

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

  /**
   * Gets animals available for adoption
   * @returns list of animals available for adoption
   */
  getAvailableForAdoption: query([], Vec(AdoptionListing), () => {
    // Return animals available for adoption
    return adoptionListings
      .values()
      .filter((listing) => listing.adoptionStatus === AdoptionStatus.Available);
  }),

  /**
   * Revokes animal listing for adoption
   * @param adoptionListingId - Adoption listing identifier
   * @returns revoked adoption listing or an error
   */
  revokeAdoptionListing: update(
    [text],
    Result(AdoptionListing, Error),
    (adoptionListingId) => {
      // Validate revoke adoption listing request
      const err: Opt<Error> =
        validateRevokeAdoptionListingRequest(adoptionListingId);
      if (err.Some) {
        return err.Some;
      }

      // Remove adoption listing
      adoptionListings.remove(adoptionListingId);

      return Ok(adoptionListing);
    }
  ),

  /**
   * Submits adoption request
   * @param adoptionListingId - Adoption listing identifier
   * @returns created adoption request or an error
   */
  submitAdoptionRequest: update(
    [text],
    Result(AdoptionRequest, Error),
    (adoptionListingId) => {
      // Validate adoption request
      const err: Opt<Error> = validateAdoptionRequest(adoptionListingId);
      if (err.Some) {
        return err.Some;
      }

      // Generate adoption request identifier
      const id = uuidv4();

      // Get adoption listing
      const adoptionListing = adoptionListings.get(adoptionListingId).Some!;

      // Populate adoption request
      const adoptionRequest: AdoptionRequest = {
        id: id,
        adoptionListingId: adoptionListing.id,
        adoptionRequestStatus: AdoptionRequestStatus.Pending,
        submittedBy: ic.caller(),
        submittedAt: ic.time(),
        updatedAt: None,
      };

      // Store adoption request
      adoptionRequests.insert(adoptionRequest.id, adoptionRequest);

      // Update adoption listing status
      adoptionListing.adoptionStatus = AdoptionStatus.OnHold;
      adoptionListings.insert(adoptionListing.id, adoptionListing);

      return Ok(adoptionRequest);
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

/**
 * Validates revoke adoption listing request
 * @param adoptionListingId - Adoption listing identifier
 * @returns optional error
 */
function validateRevokeAdoptionListingRequest(
  adoptionListingId: text
): Opt<Error> {
  // Validate adoption listing identifier
  if (!adoptionListingId) {
    return Some(Err({ BadRequest: "adoption listing ID is missing" }));
  }
  if (!adoptionListings.containsKey(adoptionListingId)) {
    return Some(
      Err({
        BadRequest: `adoption listing with id "${adoptionListingId}" not found`,
      })
    );
  }

  const adoptionListing = adoptionListings.get(adoptionListingId).Some;

  // Validate adoption listing submitter
  if (adoptionListing?.listedBy.toText() != ic.caller().toText()) {
    return Some(
      Err({
        BadRequest: "only submitter can revoke adoption listing",
      })
    );
  }

  // Validate adoption listing status
  if (adoptionListing?.adoptionStatus !== AdoptionStatus.Available) {
    return Some(
      Err({
        BadRequest: `adoption listings with status "${AdoptionStatus.Available}" cannot be revoked`,
      })
    );
  }

  return None;
}

/**
 * Validates adoption request
 * @param adoptionListingId - Adoption listing identifier
 * @returns optional error
 */
function validateAdoptionRequest(adoptionListingId: text): Opt<Error> {
  // Validate adoption listing identifier
  if (!adoptionListingId) {
    return Some(Err({ BadRequest: "adoption listing ID is missing" }));
  }
  if (!adoptionListings.containsKey(adoptionListingId)) {
    return Some(
      Err({
        BadRequest: `adoption listing with id "${adoptionListingId}" not found`,
      })
    );
  }

  const adoptionListing = adoptionListings.get(adoptionListingId).Some!;

  // Validate adoption listing status
  if (adoptionListing.adoptionStatus !== AdoptionStatus.Available) {
    return Some(
      Err({
        BadRequest: `adoption request for adoption listings with status "${adoptionListing?.adoptionStatus}" cannot be submitted`,
      })
    );
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
