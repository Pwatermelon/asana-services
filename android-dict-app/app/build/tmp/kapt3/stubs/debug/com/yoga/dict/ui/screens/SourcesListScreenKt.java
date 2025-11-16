package com.yoga.dict.ui.screens;

import androidx.compose.foundation.layout.*;
import androidx.compose.material.icons.Icons;
import androidx.compose.material.icons.filled.*;
import androidx.compose.material3.*;
import androidx.compose.runtime.*;
import androidx.compose.ui.Alignment;
import androidx.compose.ui.Modifier;
import androidx.compose.ui.text.font.FontWeight;
import com.yoga.dict.data.model.Source;
import com.yoga.dict.ui.viewmodel.SourcesViewModel;

@kotlin.Metadata(mv = {1, 9, 0}, k = 2, xi = 48, d1 = {"\u0000$\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\u001a0\u0010\u0000\u001a\u00020\u00012\u0006\u0010\u0002\u001a\u00020\u00032\f\u0010\u0004\u001a\b\u0012\u0004\u0012\u00020\u00010\u00052\u0010\b\u0002\u0010\u0006\u001a\n\u0012\u0004\u0012\u00020\u0001\u0018\u00010\u0005H\u0007\u001a4\u0010\u0007\u001a\u00020\u00012\u0012\u0010\b\u001a\u000e\u0012\u0004\u0012\u00020\u0003\u0012\u0004\u0012\u00020\u00010\t2\f\u0010\n\u001a\b\u0012\u0004\u0012\u00020\u00010\u00052\b\b\u0002\u0010\u000b\u001a\u00020\fH\u0007\u00a8\u0006\r"}, d2 = {"SourceCard", "", "source", "Lcom/yoga/dict/data/model/Source;", "onClick", "Lkotlin/Function0;", "onDelete", "SourcesListScreen", "onSourceClick", "Lkotlin/Function1;", "onAddSource", "viewModel", "Lcom/yoga/dict/ui/viewmodel/SourcesViewModel;", "app_debug"})
public final class SourcesListScreenKt {
    
    @kotlin.OptIn(markerClass = {androidx.compose.material3.ExperimentalMaterial3Api.class})
    @androidx.compose.runtime.Composable()
    public static final void SourcesListScreen(@org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super com.yoga.dict.data.model.Source, kotlin.Unit> onSourceClick, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onAddSource, @org.jetbrains.annotations.NotNull()
    com.yoga.dict.ui.viewmodel.SourcesViewModel viewModel) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void SourceCard(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.model.Source source, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onClick, @org.jetbrains.annotations.Nullable()
    kotlin.jvm.functions.Function0<kotlin.Unit> onDelete) {
    }
}