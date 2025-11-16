package com.yoga.dict.ui.viewmodel;

import com.yoga.dict.data.repository.AsanaRepository;
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
public final class AsanaViewModel_Factory implements Factory<AsanaViewModel> {
  private final Provider<AsanaRepository> repositoryProvider;

  public AsanaViewModel_Factory(Provider<AsanaRepository> repositoryProvider) {
    this.repositoryProvider = repositoryProvider;
  }

  @Override
  public AsanaViewModel get() {
    return newInstance(repositoryProvider.get());
  }

  public static AsanaViewModel_Factory create(Provider<AsanaRepository> repositoryProvider) {
    return new AsanaViewModel_Factory(repositoryProvider);
  }

  public static AsanaViewModel newInstance(AsanaRepository repository) {
    return new AsanaViewModel(repository);
  }
}
