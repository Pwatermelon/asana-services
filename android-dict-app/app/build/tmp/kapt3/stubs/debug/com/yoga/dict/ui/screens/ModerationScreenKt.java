package com.yoga.dict.ui.screens;

import android.net.Uri;
import android.widget.Toast;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.compose.foundation.layout.*;
import androidx.compose.material.icons.Icons;
import androidx.compose.material.icons.filled.*;
import androidx.compose.material3.*;
import androidx.compose.runtime.*;
import androidx.compose.ui.Alignment;
import androidx.compose.ui.Modifier;
import androidx.compose.ui.layout.ContentScale;
import androidx.compose.ui.text.font.FontWeight;
import coil.request.ImageRequest;
import com.yoga.dict.data.api.ModerationItem;
import com.yoga.dict.ui.viewmodel.ModerationViewModel;
import java.io.File;

@kotlin.Metadata(mv = {1, 9, 0}, k = 2, xi = 48, d1 = {"\u0000\u001c\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\u001a\u001e\u0010\u0000\u001a\u00020\u00012\u0006\u0010\u0002\u001a\u00020\u00032\f\u0010\u0004\u001a\b\u0012\u0004\u0012\u00020\u00010\u0005H\u0007\u001a \u0010\u0006\u001a\u00020\u00012\f\u0010\u0007\u001a\b\u0012\u0004\u0012\u00020\u00010\u00052\b\b\u0002\u0010\b\u001a\u00020\tH\u0007\u00a8\u0006\n"}, d2 = {"ModerationItemCard", "", "item", "Lcom/yoga/dict/data/api/ModerationItem;", "onClick", "Lkotlin/Function0;", "ModerationScreen", "onBack", "viewModel", "Lcom/yoga/dict/ui/viewmodel/ModerationViewModel;", "app_debug"})
public final class ModerationScreenKt {
    
    @kotlin.OptIn(markerClass = {androidx.compose.material3.ExperimentalMaterial3Api.class})
    @androidx.compose.runtime.Composable()
    public static final void ModerationScreen(@org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onBack, @org.jetbrains.annotations.NotNull()
    com.yoga.dict.ui.viewmodel.ModerationViewModel viewModel) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void ModerationItemCard(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.ModerationItem item, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onClick) {
    }
}