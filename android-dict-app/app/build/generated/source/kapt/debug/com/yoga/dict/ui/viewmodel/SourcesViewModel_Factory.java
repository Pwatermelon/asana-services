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
public final class SourcesViewModel_Factory implements Factory<SourcesViewModel> {
  private final Provider<AsanaRepository> repositoryProvider;

  public SourcesViewModel_Factory(Provider<AsanaRepository> repositoryProvider) {
    this.repositoryProvider = repositoryProvider;
  }

  @Override
  public SourcesViewModel get() {
    return newInstance(repositoryProvider.get());
  }

  public static SourcesViewModel_Factory create(Provider<AsanaRepository> repositoryProvider) {
    return new SourcesViewModel_Factory(repositoryProvider);
  }

  public static SourcesViewModel newInstance(AsanaRepository repository) {
    return new SourcesViewModel(repository);
  }
}
