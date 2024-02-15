import {
  Canister,
  Record,
  text,
  nat8,
  nat16,
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
  ic,
  Vec,
  init,
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

// Single-value data are stored in `StableBTreeMap` to preserve them across canister upgrades
// This data will be stored and retrieved using constant keys
const OWNER_KEY: text = "owner";
const SHELTER_CAPACITY_KEY: text = "shelter_capacity";

// Storage variables
const owner = StableBTreeMap<text, Principal>(0);
const employees = StableBTreeMap<text, Principal>(0);
const shelterCapacity = StableBTreeMap<text, nat16>(0);
const adoptionListings = StableBTreeMap<text, AdoptionListing>(0);
const adoptionRequests = StableBTreeMap<text, AdoptionRequest>(0);

export default Canister({
  /**
   * Initializes the canister and sets the owner of the animal adoption center
   */
  init: init([], () => {
    owner.insert(OWNER_KEY, ic.caller());
    shelterCapacity.insert(SHELTER_CAPACITY_KEY, 5);
  }),

  /**
   * Adds new employee
   * @param newEmployee - Employee to be added
   * @returns optional error
   */
  addEmployee: update([Principal], Opt(Error), (newEmployee) => {
    // Only an owner can add new employees
    if (!isCallerOwner()) {
      return Some({ Forbidden: "only an owner can add an employee" });
    }
    // Validate employee
    if (newEmployee.isAnonymous()) {
      return Some({ BadRequest: "employee cannot be anonymous" });
    }
    if (isEmployee(newEmployee)) {
      return Some({
        BadRequest: `"${newEmployee}" is already an employee`,
      });
    }

    employees.insert(newEmployee.toText(), newEmployee);

    return None;
  }),

  /**
   * Sets shelter capacity
   * @param newShelterCapacity - New shelter capacity
   * @returns optional error
   */
  setShelterCapacity: update([nat16], Opt(Error), (newShelterCapacity) => {
    // Only an owner can update shelter capacity
    if (!isCallerOwner()) {
      return Some({ Forbidden: "only an owner can set shelter capacity" });
    }
    // Validate new shelter capacity
    if (newShelterCapacity < 0) {
      return Some({ BadRequest: "shelter capacity cannot be negative" });
    }

    shelterCapacity.insert(SHELTER_CAPACITY_KEY, newShelterCapacity);

    return None;
  }),

  /**
   * Gets shelter capacity
   * @returns shelter capacity
   */
  getShelterCapacity: update([], nat16, () => {
    return shelterCapacity.get(SHELTER_CAPACITY_KEY).Some!;
  }),

  /**
   * Lists animal for adoption
   * @param payload - Payload for listing for adoption
   * @returns created adoption listing or an error
   */
  listForAdoption: update(
    [AdoptionListingPayload],
    Result(AdoptionListing, Error),
    (payload) => {
      // Validate missing fields
      if (!payload.species) {
        return Result.Err({ BadRequest: "species is missing" });
      }
      if (!payload.breed) {
        return Result.Err({ BadRequest: "breed is missing" });
      }
      if (!payload.gender) {
        return Result.Err({ BadRequest: "gender is missing" });
      }
      if (!payload.age) {
        return Result.Err({ BadRequest: "age is missing" });
      }
      // Validate invalid fields
      if (
        !Object.values(Gender).includes(payload.gender as unknown as Gender)
      ) {
        return Result.Err({ BadRequest: "invalid gender" });
      }
      // Check if there is enough space available in the shelter
      if (
        getCurrentShelterSize() + 1 >
        shelterCapacity.get(SHELTER_CAPACITY_KEY).Some!
      ) {
        return Result.Err({ BadRequest: "no more space in the shelter" });
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

      return Result.Ok(adoptionListing);
    }
  ),

  /**
   * Gets adoption listing by identifier
   * @param adoptionListingId - Adoption listing identifier
   * @returns adoption listing or an error
   */
  getAdoptionListing: query(
    [text],
    Result(AdoptionListing, Error),
    (adoptionListingId) => {
      // Validate adoption listing identifier
      if (!adoptionListingId) {
        return Result.Err({ BadRequest: "adoption listing ID is missing" });
      }
      if (!adoptionListingExists(adoptionListingId)) {
        return Result.Err({
          NotFound: `adoption listing with id "${adoptionListingId}" not found`,
        });
      }

      return Result.Ok(adoptionListings.get(adoptionListingId).Some!);
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
      // Validate adoption listing identifier
      if (!adoptionListingId) {
        return Result.Err({ BadRequest: "adoption listing ID is missing" });
      }
      if (!adoptionListingExists(adoptionListingId)) {
        return Result.Err({
          NotFound: `adoption listing with id "${adoptionListingId}" not found`,
        });
      }
      const adoptionListing = adoptionListings.get(adoptionListingId).Some!;
      // Validate adoption listing submitter
      if (adoptionListing.listedBy.toText() != ic.caller().toText()) {
        return Result.Err({
          Forbidden: "only submitter can revoke adoption listing",
        });
      }
      // Validate adoption listing status
      if (adoptionListing.adoptionStatus !== AdoptionStatus.Available) {
        return Result.Err({
          BadRequest: `adoption listings with status "${adoptionListing.adoptionStatus}" cannot be revoked`,
        });
      }

      // Remove adoption listing
      adoptionListings.remove(adoptionListingId);

      return Result.Ok(adoptionListing);
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
      // Validate adoption listing identifier
      if (!adoptionListingId) {
        return Result.Err({ BadRequest: "adoption listing ID is missing" });
      }
      if (!adoptionListingExists(adoptionListingId)) {
        return Result.Err({
          NotFound: `adoption listing with id "${adoptionListingId}" not found`,
        });
      }
      const adoptionListing = adoptionListings.get(adoptionListingId).Some!;
      // Validate adoption listing status
      if (adoptionListing.adoptionStatus !== AdoptionStatus.Available) {
        return Result.Err({
          BadRequest: `adoption request for adoption listings with status "${adoptionListing.adoptionStatus}" cannot be submitted`,
        });
      }

      // Generate adoption request identifier
      const id = uuidv4();
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
      updateAdoptionListingStatus(adoptionListing, AdoptionStatus.OnHold);

      return Result.Ok(adoptionRequest);
    }
  ),

  /**
   * Gets adoption request by identifier
   * @param adoptionRequestId - Adoption request identifier
   * @returns adoption request or an error
   */
  getAdoptionRequest: query(
    [text],
    Result(AdoptionRequest, Error),
    (adoptionRequestId) => {
      // Validate adoption request identifier
      if (!adoptionRequestId) {
        return Result.Err({ BadRequest: "adoption request ID is missing" });
      }
      if (!adoptionRequestExists(adoptionRequestId)) {
        return Result.Err({
          NotFound: `adoption request with id "${adoptionRequestId}" not found`,
        });
      }

      return Result.Ok(adoptionRequests.get(adoptionRequestId).Some!);
    }
  ),

  /**
   * Approves adoption request
   * @param adoptionRequestId - Adoption request identifier
   * @returns approved adoption request or an error
   */
  approveAdoptionRequest: update(
    [text],
    Result(AdoptionRequest, Error),
    (adoptionRequestId) => {
      // Only employees can approve adoption requests
      if (!isEmployee(ic.caller())) {
        return Result.Err({
          Forbidden: "only employees can approve adoption requests",
        });
      }
      // Validate adoption request identifier
      if (!adoptionRequestExists(adoptionRequestId)) {
        return Result.Err({
          NotFound: `adoption request with id "${adoptionRequestId}" not found`,
        });
      }
      const adoptionRequest = adoptionRequests.get(adoptionRequestId).Some!;
      // Validate adoption request status
      if (
        adoptionRequest.adoptionRequestStatus != AdoptionRequestStatus.Pending
      ) {
        return Result.Err({
          BadRequest: `adoption request with status "${adoptionRequest.adoptionRequestStatus}" cannot be approved`,
        });
      }

      // Update adoption request status
      updateAdoptionRequestStatus(
        adoptionRequest,
        AdoptionRequestStatus.Approved
      );
      // Get adoption listing
      const adoptionListing = adoptionListings.get(
        adoptionRequest.adoptionListingId
      ).Some!;
      // Update adoption listing status
      updateAdoptionListingStatus(adoptionListing, AdoptionStatus.Adopted);

      return Result.Ok(adoptionRequest);
    }
  ),

  /**
   * Rejects adoption request
   * @param adoptionRequestId - Adoption request identifier
   * @returns rejected adoption request or an error
   */
  rejectAdoptionRequest: update(
    [text],
    Result(AdoptionRequest, Error),
    (adoptionRequestId) => {
      // Only employees can reject adoption requests
      if (!isEmployee(ic.caller())) {
        return Result.Err({
          Forbidden: "only employees can reject adoption requests",
        });
      }
      // Validate adoption request identifier
      if (!adoptionRequestExists(adoptionRequestId)) {
        return Result.Err({
          NotFound: `adoption request with id "${adoptionRequestId}" not found`,
        });
      }
      const adoptionRequest = adoptionRequests.get(adoptionRequestId).Some!;
      // Validate adoption request status
      if (
        adoptionRequest.adoptionRequestStatus != AdoptionRequestStatus.Pending
      ) {
        return Result.Err({
          BadRequest: `adoption request with status "${adoptionRequest.adoptionRequestStatus}" cannot be rejected`,
        });
      }

      // Update adoption request status
      updateAdoptionRequestStatus(
        adoptionRequest,
        AdoptionRequestStatus.Rejected
      );
      // Get adoption listing
      const adoptionListing = adoptionListings.get(
        adoptionRequest.adoptionListingId
      ).Some!;
      // Update adoption listing status
      updateAdoptionListingStatus(adoptionListing, AdoptionStatus.Available);

      return Result.Ok(adoptionRequest);
    }
  ),
});

/**
 * Checks if the caller is the owner
 * @returns True if the caller is the owner, false otherwise
 */
const isCallerOwner = (): boolean => {
  return ic.caller().toText() === owner.get(OWNER_KEY).Some!.toText();
};

/**
 * Checks if the user is an employee
 * @param user - The user to check
 * @returns True if the user is an employee, false otherwise
 */
const isEmployee = (user: Principal): boolean => {
  return employees.containsKey(user.toText());
};

/**
 * Checks if the adoption listing exists
 * @param adoptionListingId - Adoption listing identifier
 * @returns True if the adoption listing exists, false otherwise
 */
const adoptionListingExists = (adoptionListingId: text): boolean => {
  return adoptionListings.containsKey(adoptionListingId);
};

/**
 * Checks if the adoption request exists
 * @param adoptionRequestId - Adoption request identifier
 * @returns True if the adoption request exists, false otherwise
 */
const adoptionRequestExists = (adoptionRequestId: text): boolean => {
  return adoptionRequests.containsKey(adoptionRequestId);
};

/**
 * Gets current shelter size
 * @returns current shelter size
 */
function getCurrentShelterSize(): number {
  return adoptionListings
    .values()
    .filter((listing) => listing.adoptionStatus !== AdoptionStatus.Adopted)
    .length;
}

/**
 * Update the adoption listing status
 * @param adoptionListing - Adoption listing to be updated
 * @param newStatus - New adoption status
 */
function updateAdoptionListingStatus(
  adoptionListing: AdoptionListing,
  newStatus: AdoptionStatus
): void {
  adoptionListing.adoptionStatus = newStatus;
  adoptionListing.updatedAt = Some(ic.time());
  adoptionListings.insert(adoptionListing.id, adoptionListing);
}

/**
 * Update the adoption request status
 * @param adoptionRequest - Adoption request to be updated
 * @param newStatus - New adoption request status
 */
function updateAdoptionRequestStatus(
  adoptionRequest: AdoptionRequest,
  newStatus: AdoptionRequestStatus
): void {
  adoptionRequest.adoptionRequestStatus = newStatus;
  adoptionRequest.updatedAt = Some(ic.time());
  adoptionRequests.insert(adoptionRequest.id, adoptionRequest);
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
