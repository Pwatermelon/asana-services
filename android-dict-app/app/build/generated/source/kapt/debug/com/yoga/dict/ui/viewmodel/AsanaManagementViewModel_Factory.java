package com.yoga.dict.ui.viewmodel;

import com.yoga.dict.data.repository.AsanaManagementRepository;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata
@QualifierMetadata
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava"
})
public final class AsanaManagementViewModel_Factory implements Factory<AsanaManagementViewModel> {
  private final Provider<AsanaManagementRepository> repositoryProvider;

  public AsanaManagementViewModel_Factory(Provider<AsanaManagementRepository> repositoryProvider) {
    this.repositoryProvider = repositoryProvider;
  }

  @Override
  public AsanaManagementViewModel get() {
    return newInstance(repositoryProvider.get());
  }

  public static AsanaManagementViewModel_Factory create(
      Provider<AsanaManagementRepository> repositoryProvider) {
    return new AsanaManagementViewModel_Factory(repositoryProvider);
  }

  public static AsanaManagementViewModel newInstance(AsanaManagementRepository repository) {
    return new AsanaManagementViewModel(repository);
  }
}
