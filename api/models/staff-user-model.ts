export interface StaffUserDatabaseSchema {
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

export interface StaffUserContactsInterface {
  email: StaffUserDatabaseSchema['email'];
  phone: StaffUserDatabaseSchema['phone'];
}

export interface StaffUserSchema {
  id: StaffUserDatabaseSchema['id'];
  userId: StaffUserDatabaseSchema['public_id'];
  name: StaffUserDatabaseSchema['name'];
  contacts: StaffUserContactsInterface;
  passwordHash: StaffUserDatabaseSchema['password_hash'];
  birthdate: StaffUserDatabaseSchema['birthdate'];
  status: StaffUserDatabaseSchema['status'];
  profilePictureUrl: StaffUserDatabaseSchema['profile_picture_url'] ;
  createdAt: StaffUserDatabaseSchema['created_at'];
  updatedAt: StaffUserDatabaseSchema['updated_at'];
  deletedAt: StaffUserDatabaseSchema['deleted_at'];
}
