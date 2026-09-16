export interface UserDatabaseSchema {
  id: string;
  public_id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  birthdate: Date;
  status: 'active' | 'disabled' | 'deleted';
  profile_picture_url: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface UserContactsInterface {
  email: UserDatabaseSchema['email'];
  phone: UserDatabaseSchema['phone'];
}

export interface UserSchema {
  id: UserDatabaseSchema['id'];
  userId: UserDatabaseSchema['public_id'];
  name: UserDatabaseSchema['name'];
  contacts: UserContactsInterface;
  passwordHash: UserDatabaseSchema['password_hash'];
  birthdate: UserDatabaseSchema['birthdate'];
  status: UserDatabaseSchema['status'];
  profilePictureUrl: UserDatabaseSchema['profile_picture_url'] ;
  createdAt: UserDatabaseSchema['created_at'];
  updatedAt: UserDatabaseSchema['updated_at'];
  deletedAt: UserDatabaseSchema['deleted_at'];
}

